"""
Seed the database with test data AND realistic feedback entries for the myCDA platform.

Usage: python manage.py seed_data_with_feedbacks

Creates:
- Full base seed data (via accounts seed_data)
- 25+ realistic feedback submissions across completed sessions
- Multi-child reviews for parent James Wilson (Emma and Liam)
- Student self-submissions and parent submissions
- Rolling feedback data for Coach Sarah and Coach Marcus
"""

from django.core.management import call_command
from django.core.management.base import BaseCommand
from accounts.models import User
from classes.models import ClassEnrollment, Session
from feedback.models import SessionFeedback


class Command(BaseCommand):
    help = "Seed the database with test data and realistic feedback entries"

    def handle(self, *args, **options):
        self.stdout.write("Running database migrations...")
        call_command("migrate", interactive=False)

        self.stdout.write("Running base seed_data...")
        call_command("seed_data")

        self.stdout.write("Seeding realistic session feedback entries...")
        SessionFeedback.objects.all().delete()

        # Fetch users
        james = User.objects.get(username="parent.james")
        priya = User.objects.get(username="parent.priya")
        david = User.objects.get(username="parent.david")
        emma = User.objects.get(username="student.emma")
        liam = User.objects.get(username="student.liam")
        anika = User.objects.get(username="student.anika")
        noah = User.objects.get(username="student.noah")
        zara = User.objects.get(username="student.zara")

        feedback_count = 0

        # Helper to safely add feedback respecting enrollments and completed status
        def add_feedback(session, student, submitter, clarity, engagement, pace, note=""):
            nonlocal feedback_count
            if session.status != "completed":
                return
            # Verify enrollment
            is_enrolled = ClassEnrollment.objects.filter(
                class_obj=session.class_obj, student=student, is_active=True
            ).exists()
            if not is_enrolled:
                return
            # Check unique_together (session, student)
            if SessionFeedback.objects.filter(session=session, student=student).exists():
                return

            SessionFeedback.objects.create(
                session=session,
                student=student,
                created_by=submitter,
                rating_clarity=clarity,
                rating_engagement=engagement,
                rating_pace=pace,
                note=note,
            )
            feedback_count += 1

        # Completed sessions
        completed_sessions = list(
            Session.objects.filter(status="completed").order_by("-scheduled_date")
        )

        for session in completed_sessions:
            cname = session.class_obj.name.lower()

            # Lincoln-Douglas Debate Fundamentals (Emma, Liam, Anika enrolled)
            if "lincoln-douglas" in cname:
                # James reviews for Liam
                add_feedback(
                    session=session,
                    student=liam,
                    submitter=james,
                    clarity=5,
                    engagement=5,
                    pace=4,
                    note="Loved it! Great breakdown of value debate frameworks.",
                )
                # James reviews for Emma
                add_feedback(
                    session=session,
                    student=emma,
                    submitter=james,
                    clarity=5,
                    engagement=4,
                    pace=5,
                    note="Very clear instruction, tournament preparation was super helpful.",
                )
                # Priya reviews for Anika
                add_feedback(
                    session=session,
                    student=anika,
                    submitter=priya,
                    clarity=4,
                    engagement=5,
                    pace=4,
                    note="Anika gained a lot of confidence from this round.",
                )

            # Public Forum Debate Advanced (Emma, Noah, Zara enrolled)
            elif "public forum" in cname:
                # Emma self-reviews
                add_feedback(
                    session=session,
                    student=emma,
                    submitter=emma,
                    clarity=5,
                    engagement=5,
                    pace=5,
                    note="Challenging economic policy round. Really liked the crossfire feedback.",
                )
                # David reviews for Noah
                add_feedback(
                    session=session,
                    student=noah,
                    submitter=david,
                    clarity=4,
                    engagement=4,
                    pace=4,
                    note="Good pacing and constructive criticism.",
                )
                # Zara self-reviews
                add_feedback(
                    session=session,
                    student=zara,
                    submitter=zara,
                    clarity=5,
                    engagement=5,
                    pace=4,
                    note="Excellent drills on rebuttal structure.",
                )

            # Middle School Parliamentary Debate (Liam, Anika, Noah enrolled)
            elif "parliamentary" in cname or "middle school" in cname:
                # James reviews for Liam
                add_feedback(
                    session=session,
                    student=liam,
                    submitter=james,
                    clarity=4,
                    engagement=5,
                    pace=4,
                    note="Liam is excited for the next debate round!",
                )
                # Anika self-reviews
                add_feedback(
                    session=session,
                    student=anika,
                    submitter=anika,
                    clarity=5,
                    engagement=4,
                    pace=5,
                    note="Loved practicing impromptu points of information.",
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully seeded database with {feedback_count} feedback entries!"
            )
        )
