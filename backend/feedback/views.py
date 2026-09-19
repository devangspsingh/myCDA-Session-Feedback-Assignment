from datetime import timedelta
from django.db import models
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.pagination import StandardPagination
from core.permissions import IsStudentOrParent, IsInstructorOrAdmin
from accounts.models import User, FamilyLink
from classes.models import Session, ClassEnrollment
from .models import SessionFeedback
from .serializers import (
    SessionFeedbackSerializer,
    EligibleSessionSerializer,
    InstructorFeedbackSummarySerializer,
)


class SessionFeedbackCreateView(generics.CreateAPIView):
    """
    Submit structured feedback for a completed session.

    Available to students and parents (on behalf of linked students).
    The submitter field is auto-populated from the authenticated user.
    """

    serializer_class = SessionFeedbackSerializer
    permission_classes = [IsStudentOrParent]


class FeedbackPagination(StandardPagination):
    page_size = 5
    page_size_query_param = "page_size"


class MyFeedbackListView(generics.ListAPIView):
    """
    List feedback submitted by the current user (or for the current user's
    linked students if they are a parent).

    Ordered by most recent first. Paginated using FeedbackPagination (default 5/page).
    """

    serializer_class = SessionFeedbackSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = FeedbackPagination

    def get_queryset(self):
        user = self.request.user
        qs = SessionFeedback.objects.select_related(
            "session",
            "session__class_obj",
            "session__class_obj__instructor",
            "student",
            "created_by",
        ).order_by("-created_at")

        if user.role == User.Role.STUDENT:
            return qs.filter(student=user)
        elif user.role == User.Role.PARENT:
            linked_student_ids = FamilyLink.objects.filter(
                parent=user
            ).values_list("student_id", flat=True)
            return qs.filter(student_id__in=linked_student_ids)
        elif user.role == User.Role.ADMIN:
            return qs.all()
        return qs.none()


class EligibleSessionsListView(generics.ListAPIView):
    """
    List sessions eligible for feedback for a student:
    - Session status is 'completed'
    - Session occurred within the last 30 days
    - Student is actively enrolled in the session's class
    - Student has not already submitted feedback for this session
    """

    serializer_class = EligibleSessionSerializer
    permission_classes = [IsStudentOrParent]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        target_student = None

        if user.role == User.Role.STUDENT:
            target_student = user
        elif user.role == User.Role.PARENT:
            student_id = self.request.query_params.get("student_id")
            if not student_id or str(student_id) == str(user.id):
                # Default to the first linked student if available
                first_link = (
                    FamilyLink.objects.filter(parent=user)
                    .select_related("student")
                    .first()
                )
                if first_link:
                    target_student = first_link.student
                else:
                    return Session.objects.none()
            else:
                link = (
                    FamilyLink.objects.filter(
                        parent=user, student_id=student_id
                    )
                    .select_related("student")
                    .first()
                )
                if link:
                    target_student = link.student
                else:
                    return Session.objects.none()

        if not target_student:
            return Session.objects.none()

        now = timezone.now()
        thirty_days_ago = now - timedelta(days=30)

        # Classes student is actively enrolled in
        enrolled_class_ids = ClassEnrollment.objects.filter(
            student=target_student, is_active=True
        ).values_list("class_obj_id", flat=True)

        # Completed sessions within last 30 days
        eligible_sessions = Session.objects.filter(
            class_obj_id__in=enrolled_class_ids,
            status=Session.Status.COMPLETED,
            scheduled_date__gte=thirty_days_ago,
        ).select_related("class_obj", "class_obj__instructor")

        # Exclude sessions where feedback already exists for this student
        reviewed_session_ids = SessionFeedback.objects.filter(
            student=target_student
        ).values_list("session_id", flat=True)

        return eligible_sessions.exclude(id__in=reviewed_session_ids).order_by(
            "-scheduled_date"
        )


class InstructorSummaryView(APIView):
    """
    Aggregated feedback summary for instructors.

    Available to instructors and admins only.
    - Anonymized: strictly aggregated metrics, NO student identities or notes.
    - Rolling window: last 10 completed sessions for this instructor.
    - Weighted average: each session's score is weighted by its duration_minutes.
    - Admin can pass ?instructor_id=X to inspect a specific instructor.
    """

    permission_classes = [IsInstructorOrAdmin]

    def get(self, request):
        user = request.user
        instructor = None

        if user.role == User.Role.INSTRUCTOR:
            instructor = user
        elif user.role == User.Role.ADMIN:
            instructor_id = request.query_params.get("instructor_id")
            instructor = None
            if instructor_id:
                if str(instructor_id).isdigit():
                    instructor = User.objects.filter(
                        id=int(instructor_id), role=User.Role.INSTRUCTOR
                    ).first()
                if not instructor:
                    instructor = User.objects.filter(
                        username=instructor_id, role=User.Role.INSTRUCTOR
                    ).first()

            # Default to the first instructor if none specified or ID not found
            if not instructor:
                instructor = (
                    User.objects.filter(role=User.Role.INSTRUCTOR)
                    .order_by("id")
                    .first()
                )
                if not instructor:
                    return Response(
                        {"detail": "No instructor found."},
                        status=status.HTTP_404_NOT_FOUND,
                    )

        # Last 10 completed sessions taught by this instructor
        recent_sessions = list(
            Session.objects.filter(
                class_obj__instructor=instructor,
                status=Session.Status.COMPLETED,
            )
            .order_by("-scheduled_date")[:10]
        )

        total_feedback_count = 0
        total_sessions_evaluated = 0

        weighted_clarity_sum = 0.0
        weighted_engagement_sum = 0.0
        weighted_pace_sum = 0.0
        total_duration_weight = 0.0

        for s in recent_sessions:
            feedbacks = s.feedbacks.all()
            count = feedbacks.count()
            if count == 0:
                continue

            total_feedback_count += count
            total_sessions_evaluated += 1

            duration = s.session_metadata.get("duration_minutes", 60)
            avg_scores = feedbacks.aggregate(
                avg_clarity=models.Avg("rating_clarity"),
                avg_engagement=models.Avg("rating_engagement"),
                avg_pace=models.Avg("rating_pace"),
            )

            clarity_avg = avg_scores["avg_clarity"] or 0.0
            engagement_avg = avg_scores["avg_engagement"] or 0.0
            pace_avg = avg_scores["avg_pace"] or 0.0

            weighted_clarity_sum += duration * clarity_avg
            weighted_engagement_sum += duration * engagement_avg
            weighted_pace_sum += duration * pace_avg
            total_duration_weight += duration

        if total_duration_weight > 0:
            final_clarity = round(weighted_clarity_sum / total_duration_weight, 2)
            final_engagement = round(
                weighted_engagement_sum / total_duration_weight, 2
            )
            final_pace = round(weighted_pace_sum / total_duration_weight, 2)
            overall_score = round(
                (final_clarity + final_engagement + final_pace) / 3.0, 2
            )
        else:
            final_clarity = None
            final_engagement = None
            final_pace = None
            overall_score = None

        summary_data = {
            "instructor_id": instructor.id,
            "instructor_name": instructor.get_display_name(),
            "total_feedback_count": total_feedback_count,
            "total_sessions_evaluated": total_sessions_evaluated,
            "rating_clarity": final_clarity,
            "rating_engagement": final_engagement,
            "rating_pace": final_pace,
            "overall_score": overall_score,
            "sessions_analyzed": len(recent_sessions),
        }

        serializer = InstructorFeedbackSummarySerializer(summary_data)
        return Response(serializer.data, status=status.HTTP_200_OK)
