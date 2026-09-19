from datetime import timedelta
from django.utils import timezone
from rest_framework import serializers

from core.serializers import BaseModelSerializer, ReadOnlyBaseSerializer
from accounts.models import User, FamilyLink
from accounts.serializers import UserMinimalSerializer
from classes.models import Session, ClassEnrollment
from classes.serializers import SessionSerializer
from .models import SessionFeedback


class SessionFeedbackSerializer(BaseModelSerializer):
    """
    Serializer for submitting and retrieving session feedback.

    - Extends BaseModelSerializer for standard audit fields and automatic
      created_by population from RequestAuditMiddleware.
    - Never accepts 'submitter' or 'created_by' in request body; they are read-only.
    - Validates 30-day completion window, session completion status, student
      enrollment, parent-child links, and (session, student) uniqueness.
    """

    session_detail = SessionSerializer(source="session", read_only=True)
    student = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=User.Role.STUDENT),
        required=False,
        allow_null=True,
    )
    student_display = UserMinimalSerializer(source="student", read_only=True)
    submitter = serializers.PrimaryKeyRelatedField(
        source="created_by", read_only=True
    )
    submitter_display = UserMinimalSerializer(
        source="created_by", read_only=True
    )

    class Meta:
        model = SessionFeedback
        fields = [
            "id",
            "session",
            "session_detail",
            "student",
            "student_display",
            "submitter",
            "submitter_display",
            "rating_clarity",
            "rating_engagement",
            "rating_pace",
            "note",
            "created_at",
            "updated_at",
            "created_by_display",
        ]
        read_only_fields = [
            "id",
            "submitter",
            "submitter_display",
            "student_display",
            "session_detail",
            "created_at",
            "updated_at",
            "created_by_display",
        ]
        validators = []

    def validate(self, attrs):
        # Retrieve authenticated user from context or middleware
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        if not user or not getattr(user, "is_authenticated", False):
            from core.middleware import get_current_user
            user = get_current_user()

        session = attrs.get("session")
        if not session:
            raise serializers.ValidationError({"session": "Session is required."})

        # 1. Feedback can only be submitted for completed sessions
        if session.status != Session.Status.COMPLETED:
            raise serializers.ValidationError(
                {"session": "Feedback can only be submitted for completed sessions."}
            )

        # 2. Cannot submit for sessions completed more than 30 days ago
        now = timezone.now()
        thirty_days_ago = now - timedelta(days=30)
        if session.scheduled_date < thirty_days_ago:
            raise serializers.ValidationError(
                {
                    "session": (
                        "Feedback cannot be submitted for sessions completed "
                        "more than 30 days ago."
                    )
                }
            )

        # 3. Determine student representation & authorization
        student = attrs.get("student")
        if user and user.role == User.Role.STUDENT:
            if student and student != user:
                raise serializers.ValidationError(
                    {"student": "Students can only submit feedback for themselves."}
                )
            attrs["student"] = user
            student = user
        elif user and user.role == User.Role.PARENT:
            if not student:
                raise serializers.ValidationError(
                    {"student": "Student selection is required for parent submissions."}
                )
            if not FamilyLink.objects.filter(parent=user, student=student).exists():
                raise serializers.ValidationError(
                    {
                        "student": (
                            "You are not authorized to submit feedback for this student."
                        )
                    }
                )
        elif user and user.role == User.Role.ADMIN:
            if not student:
                raise serializers.ValidationError(
                    {"student": "Student selection is required."}
                )
        else:
            if not student:
                raise serializers.ValidationError(
                    {"student": "Student is required."}
                )

        # Ensure student is enrolled in the session's class
        is_enrolled = ClassEnrollment.objects.filter(
            class_obj=session.class_obj,
            student=student,
            is_active=True,
        ).exists()
        if not is_enrolled:
            raise serializers.ValidationError(
                {
                    "student": (
                        f"{student.get_display_name()} is not enrolled in "
                        f"{session.class_obj.name}."
                    )
                }
            )

        # 4. Enforce uniqueness on (session, student)
        existing = SessionFeedback.objects.filter(
            session=session, student=student
        )
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError(
                "Feedback has already been submitted for this session."
            )

        # 5. Rating validation (1 to 5)
        for rating_field in ("rating_clarity", "rating_engagement", "rating_pace"):
            val = attrs.get(rating_field)
            if val is not None and not (1 <= val <= 5):
                raise serializers.ValidationError(
                    {rating_field: "Rating must be an integer between 1 and 5."}
                )

        # 6. Note length validation (max 500 chars)
        note = attrs.get("note", "")
        if note and len(note) > 500:
            raise serializers.ValidationError(
                {"note": "Note cannot exceed 500 characters."}
            )

        return attrs


class EligibleSessionSerializer(ReadOnlyBaseSerializer):
    """
    Lightweight read-only representation of a session eligible for feedback.
    """

    class_name = serializers.CharField(source="class_obj.name", read_only=True)
    instructor_name = serializers.CharField(
        source="class_obj.instructor.get_display_name", read_only=True
    )
    duration_minutes = serializers.IntegerField(read_only=True)
    topic = serializers.CharField(read_only=True)

    class Meta:
        model = Session
        fields = [
            "id",
            "class_obj",
            "class_name",
            "instructor_name",
            "scheduled_date",
            "status",
            "duration_minutes",
            "topic",
        ]


class InstructorFeedbackSummarySerializer(serializers.Serializer):
    """
    Strictly anonymized aggregation serializer for the instructor summary endpoint.

    Contains ONLY aggregated numbers and meta summary stats.
    Excludes any student identities, submitter identities, or raw notes.
    """

    instructor_id = serializers.IntegerField()
    instructor_name = serializers.CharField()
    total_feedback_count = serializers.IntegerField()
    total_sessions_evaluated = serializers.IntegerField()
    rating_clarity = serializers.FloatField(allow_null=True)
    rating_engagement = serializers.FloatField(allow_null=True)
    rating_pace = serializers.FloatField(allow_null=True)
    overall_score = serializers.FloatField(allow_null=True)
    sessions_analyzed = serializers.IntegerField()
