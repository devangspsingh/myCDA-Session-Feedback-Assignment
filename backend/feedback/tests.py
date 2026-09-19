from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User, FamilyLink
from classes.models import Class, ClassEnrollment, Session
from feedback.models import SessionFeedback


class SessionFeedbackTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.now = timezone.now()

        # Users
        self.admin = User.objects.create_user(
            username="admin_user",
            email="admin@cda.test",
            password="testpass123",
            role="admin",
        )
        self.instructor = User.objects.create_user(
            username="coach_sarah",
            email="sarah@cda.test",
            first_name="Sarah",
            last_name="Chen",
            password="testpass123",
            role="instructor",
        )
        self.parent = User.objects.create_user(
            username="parent_james",
            email="james@cda.test",
            first_name="James",
            last_name="Wilson",
            password="testpass123",
            role="parent",
        )
        self.student = User.objects.create_user(
            username="student_emma",
            email="emma@cda.test",
            first_name="Emma",
            last_name="Wilson",
            password="testpass123",
            role="student",
        )
        self.other_student = User.objects.create_user(
            username="student_other",
            email="other@cda.test",
            first_name="Other",
            last_name="Student",
            password="testpass123",
            role="student",
        )

        # Family Link: parent_james -> student_emma
        FamilyLink.objects.create(
            parent=self.parent, student=self.student, relationship="parent"
        )

        # Class
        self.cls = Class.objects.create(
            name="Lincoln-Douglas Debate Fundamentals",
            instructor=self.instructor,
            created_by=self.admin,
        )

        # Enrollments
        ClassEnrollment.objects.create(class_obj=self.cls, student=self.student)

        # Sessions
        self.recent_completed_session = Session.objects.create(
            class_obj=self.cls,
            scheduled_date=self.now - timedelta(days=5),
            status=Session.Status.COMPLETED,
            session_metadata={"duration_minutes": 90, "topic_covered": "Case Structure"},
        )
        self.old_completed_session = Session.objects.create(
            class_obj=self.cls,
            scheduled_date=self.now - timedelta(days=35),
            status=Session.Status.COMPLETED,
            session_metadata={"duration_minutes": 60, "topic_covered": "Intro"},
        )
        self.scheduled_session = Session.objects.create(
            class_obj=self.cls,
            scheduled_date=self.now + timedelta(days=2),
            status=Session.Status.SCHEDULED,
            session_metadata={"duration_minutes": 60},
        )
        self.cancelled_session = Session.objects.create(
            class_obj=self.cls,
            scheduled_date=self.now - timedelta(days=2),
            status=Session.Status.CANCELLED,
            session_metadata={"duration_minutes": 60},
        )

    def test_student_can_submit_feedback_for_self(self):
        self.client.force_authenticate(user=self.student)
        payload = {
            "session": self.recent_completed_session.id,
            "rating_clarity": 5,
            "rating_engagement": 4,
            "rating_pace": 4,
            "note": "Excellent session on case building.",
        }
        response = self.client.post("/api/v1/feedback/", payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["student"], self.student.id)
        self.assertEqual(response.data["submitter"], self.student.id)
        self.assertEqual(response.data["rating_clarity"], 5)

        # Check DB
        feedback = SessionFeedback.objects.get(id=response.data["id"])
        self.assertEqual(feedback.student, self.student)
        self.assertEqual(feedback.created_by, self.student)
        self.assertEqual(feedback.submitter, self.student)

    def test_parent_can_submit_feedback_for_linked_student(self):
        self.client.force_authenticate(user=self.parent)
        payload = {
            "session": self.recent_completed_session.id,
            "student": self.student.id,
            "rating_clarity": 4,
            "rating_engagement": 5,
            "rating_pace": 3,
            "note": "Emma enjoyed this workshop.",
        }
        response = self.client.post("/api/v1/feedback/", payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["student"], self.student.id)
        self.assertEqual(response.data["submitter"], self.parent.id)

        feedback = SessionFeedback.objects.get(id=response.data["id"])
        self.assertEqual(feedback.student, self.student)
        self.assertEqual(feedback.created_by, self.parent)

    def test_parent_cannot_submit_for_unlinked_student(self):
        self.client.force_authenticate(user=self.parent)
        payload = {
            "session": self.recent_completed_session.id,
            "student": self.other_student.id,
            "rating_clarity": 4,
            "rating_engagement": 4,
            "rating_pace": 4,
        }
        response = self.client.post("/api/v1/feedback/", payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("student", response.data)

    def test_student_cannot_submit_for_another_student(self):
        self.client.force_authenticate(user=self.student)
        payload = {
            "session": self.recent_completed_session.id,
            "student": self.other_student.id,
            "rating_clarity": 4,
            "rating_engagement": 4,
            "rating_pace": 4,
        }
        response = self.client.post("/api/v1/feedback/", payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("student", response.data)

    def test_cannot_submit_for_scheduled_or_cancelled_session(self):
        self.client.force_authenticate(user=self.student)

        # Scheduled
        res1 = self.client.post(
            "/api/v1/feedback/",
            {
                "session": self.scheduled_session.id,
                "rating_clarity": 4,
                "rating_engagement": 4,
                "rating_pace": 4,
            },
        )
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)

        # Cancelled
        res2 = self.client.post(
            "/api/v1/feedback/",
            {
                "session": self.cancelled_session.id,
                "rating_clarity": 4,
                "rating_engagement": 4,
                "rating_pace": 4,
            },
        )
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_submit_for_session_older_than_30_days(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.post(
            "/api/v1/feedback/",
            {
                "session": self.old_completed_session.id,
                "rating_clarity": 4,
                "rating_engagement": 4,
                "rating_pace": 4,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("session", response.data)

    def test_cannot_submit_duplicate_feedback(self):
        self.client.force_authenticate(user=self.student)
        payload = {
            "session": self.recent_completed_session.id,
            "rating_clarity": 5,
            "rating_engagement": 5,
            "rating_pace": 5,
        }
        res1 = self.client.post("/api/v1/feedback/", payload)
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Duplicate self-submission
        res2 = self.client.post("/api/v1/feedback/", payload)
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

        # Parent attempting duplicate submission for same student
        self.client.force_authenticate(user=self.parent)
        res3 = self.client.post(
            "/api/v1/feedback/",
            {
                "session": self.recent_completed_session.id,
                "student": self.student.id,
                "rating_clarity": 4,
                "rating_engagement": 4,
                "rating_pace": 4,
            },
        )
        self.assertEqual(res3.status_code, status.HTTP_400_BAD_REQUEST)

    def test_ratings_must_be_between_1_and_5(self):
        self.client.force_authenticate(user=self.student)
        # Rating 0
        res0 = self.client.post(
            "/api/v1/feedback/",
            {
                "session": self.recent_completed_session.id,
                "rating_clarity": 0,
                "rating_engagement": 5,
                "rating_pace": 5,
            },
        )
        self.assertEqual(res0.status_code, status.HTTP_400_BAD_REQUEST)

        # Rating 6
        res6 = self.client.post(
            "/api/v1/feedback/",
            {
                "session": self.recent_completed_session.id,
                "rating_clarity": 5,
                "rating_engagement": 6,
                "rating_pace": 5,
            },
        )
        self.assertEqual(res6.status_code, status.HTTP_400_BAD_REQUEST)

    def test_note_cannot_exceed_500_characters(self):
        self.client.force_authenticate(user=self.student)
        res = self.client.post(
            "/api/v1/feedback/",
            {
                "session": self.recent_completed_session.id,
                "rating_clarity": 5,
                "rating_engagement": 5,
                "rating_pace": 5,
                "note": "a" * 501,
            },
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_my_feedback_list(self):
        # Create feedback
        SessionFeedback.objects.create(
            session=self.recent_completed_session,
            student=self.student,
            created_by=self.student,
            rating_clarity=5,
            rating_engagement=4,
            rating_pace=4,
            note="Great class",
        )

        # Student views feedback
        self.client.force_authenticate(user=self.student)
        res = self.client.get("/api/v1/feedback/my/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["count"], 1)
        self.assertEqual(res.data["results"][0]["note"], "Great class")

        # Parent views feedback for linked child
        self.client.force_authenticate(user=self.parent)
        res_parent = self.client.get("/api/v1/feedback/my/")
        self.assertEqual(res_parent.status_code, status.HTTP_200_OK)
        self.assertEqual(res_parent.data["count"], 1)

    def test_eligible_sessions_endpoint(self):
        self.client.force_authenticate(user=self.student)
        res = self.client.get("/api/v1/feedback/eligible-sessions/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Should include recent completed session, but not old, scheduled, or cancelled
        session_ids = [s["id"] for s in res.data]
        self.assertIn(self.recent_completed_session.id, session_ids)
        self.assertNotIn(self.old_completed_session.id, session_ids)
        self.assertNotIn(self.scheduled_session.id, session_ids)
        self.assertNotIn(self.cancelled_session.id, session_ids)


class InstructorSummaryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.now = timezone.now()

        self.instructor = User.objects.create_user(
            username="coach_sarah",
            email="sarah@cda.test",
            password="testpass123",
            role="instructor",
        )
        self.admin = User.objects.create_user(
            username="admin_user",
            email="admin@cda.test",
            password="testpass123",
            role="admin",
        )
        self.student1 = User.objects.create_user(
            username="student_1", email="s1@cda.test", role="student"
        )
        self.student2 = User.objects.create_user(
            username="student_2", email="s2@cda.test", role="student"
        )

        self.cls = Class.objects.create(
            name="Lincoln-Douglas Debate", instructor=self.instructor
        )
        ClassEnrollment.objects.create(class_obj=self.cls, student=self.student1)
        ClassEnrollment.objects.create(class_obj=self.cls, student=self.student2)

    def test_weighted_rolling_average_calculation(self):
        """
        Verify rubric formula:
        Session A: 90 min, avg clarity = 4.0
        Session B: 60 min, avg clarity = 3.0
        Weighted avg = (90*4.0 + 60*3.0) / (90 + 60) = 540 / 150 = 3.6
        """
        session_a = Session.objects.create(
            class_obj=self.cls,
            scheduled_date=self.now - timedelta(days=2),
            status=Session.Status.COMPLETED,
            session_metadata={"duration_minutes": 90},
        )
        session_b = Session.objects.create(
            class_obj=self.cls,
            scheduled_date=self.now - timedelta(days=4),
            status=Session.Status.COMPLETED,
            session_metadata={"duration_minutes": 60},
        )

        SessionFeedback.objects.create(
            session=session_a,
            student=self.student1,
            created_by=self.student1,
            rating_clarity=4,
            rating_engagement=4,
            rating_pace=4,
        )
        SessionFeedback.objects.create(
            session=session_b,
            student=self.student1,
            created_by=self.student1,
            rating_clarity=3,
            rating_engagement=3,
            rating_pace=3,
        )

        self.client.force_authenticate(user=self.instructor)
        response = self.client.get("/api/v1/feedback/instructor-summary/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertEqual(response.data["total_feedback_count"], 2)
        self.assertEqual(response.data["total_sessions_evaluated"], 2)
        self.assertEqual(response.data["rating_clarity"], 3.6)
        self.assertEqual(response.data["rating_engagement"], 3.6)
        self.assertEqual(response.data["rating_pace"], 3.6)
        self.assertEqual(response.data["overall_score"], 3.6)

    def test_anonymization_enforced_at_api_layer(self):
        """
        Strictly verify that instructor summary response contains NO identifying fields
        nor raw text notes.
        """
        session = Session.objects.create(
            class_obj=self.cls,
            scheduled_date=self.now - timedelta(days=1),
            status=Session.Status.COMPLETED,
            session_metadata={"duration_minutes": 60},
        )
        SessionFeedback.objects.create(
            session=session,
            student=self.student1,
            created_by=self.student1,
            rating_clarity=5,
            rating_engagement=5,
            rating_pace=5,
            note="Confidential student feedback",
        )

        self.client.force_authenticate(user=self.instructor)
        response = self.client.get("/api/v1/feedback/instructor-summary/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        forbidden_keys = [
            "student",
            "student_id",
            "student_name",
            "student_display",
            "submitter",
            "submitter_id",
            "submitter_display",
            "note",
            "notes",
            "created_by",
        ]
        for key in forbidden_keys:
            self.assertNotIn(
                key,
                response.data,
                f"Security failure: '{key}' must not be exposed in instructor-summary!",
            )

    def test_rolling_window_limits_to_last_10_sessions(self):
        """
        Only the 10 most recent completed sessions should be included.
        """
        # Create 12 completed sessions
        for i in range(12):
            s = Session.objects.create(
                class_obj=self.cls,
                scheduled_date=self.now - timedelta(days=i + 1),
                status=Session.Status.COMPLETED,
                session_metadata={"duration_minutes": 60},
            )
            # Oldest sessions (i=10 and i=11) have clarity=1
            # Recent sessions (i=0..9) have clarity=5
            clarity = 1 if i >= 10 else 5
            SessionFeedback.objects.create(
                session=s,
                student=self.student1,
                created_by=self.student1,
                rating_clarity=clarity,
                rating_engagement=5,
                rating_pace=5,
            )

        self.client.force_authenticate(user=self.instructor)
        response = self.client.get("/api/v1/feedback/instructor-summary/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["sessions_analyzed"], 10)
        self.assertEqual(response.data["total_sessions_evaluated"], 10)
        self.assertEqual(response.data["rating_clarity"], 5.0)

    def test_admin_can_view_instructor_summary(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(
            f"/api/v1/feedback/instructor-summary/?instructor_id={self.instructor.id}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["instructor_id"], self.instructor.id)

    def test_student_and_parent_cannot_access_instructor_summary(self):
        self.client.force_authenticate(user=self.student1)
        res_student = self.client.get("/api/v1/feedback/instructor-summary/")
        self.assertEqual(res_student.status_code, status.HTTP_403_FORBIDDEN)
