from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from accounts.models import User
from classes.models import Session


class SessionFeedbackQuerySet(models.QuerySet):
    """
    Custom queryset that allows filtering transparently by 'submitter'
    or 'created_by' for complete compatibility.
    """

    def filter(self, *args, **kwargs):
        new_kwargs = {}
        for k, v in kwargs.items():
            if k == "submitter":
                new_kwargs["created_by"] = v
            elif k.startswith("submitter__"):
                new_kwargs["created_by__" + k[11:]] = v
            else:
                new_kwargs[k] = v
        return super().filter(*args, **new_kwargs)


class SessionFeedback(models.Model):
    """
    Session feedback captured for a completed class session.

    Each feedback entry captures:
    - The session it refers to (FK to Session)
    - The student who is being represented (FK to User, role='student')
    - The submitter (created_by FK to User, auto-populated from auth user)
    - Three rating dimensions (clarity, engagement, pace), each 1-5
    - Optional note (max 500 characters)
    - Timestamps (created_at, updated_at)

    Uniqueness is enforced on (session, student).
    """

    session = models.ForeignKey(
        Session,
        on_delete=models.CASCADE,
        related_name="feedbacks",
    )
    student = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="received_feedbacks",
        limit_choices_to={"role": "student"},
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="submitted_feedbacks",
        verbose_name="submitter",
    )
    rating_clarity = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="How clearly the instructor explained concepts (1-5)",
    )
    rating_engagement = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="How engaging the session was (1-5)",
    )
    rating_pace = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Whether the pacing felt right (1-5)",
    )
    note = models.TextField(
        max_length=500,
        blank=True,
        help_text="Optional comments (max 500 characters)",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = SessionFeedbackQuerySet.as_manager()

    class Meta:
        unique_together = ("session", "student")
        ordering = ["-created_at"]
        verbose_name = "session feedback"
        verbose_name_plural = "session feedbacks"

    @property
    def submitter(self):
        """Alias for created_by to match assignment terminology."""
        return self.created_by

    @submitter.setter
    def submitter(self, value):
        self.created_by = value

    def __str__(self):
        return f"Feedback for {self.session} ({self.student.get_display_name()})"
