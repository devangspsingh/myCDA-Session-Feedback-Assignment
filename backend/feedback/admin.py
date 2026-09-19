from django.contrib import admin
from .models import SessionFeedback


@admin.register(SessionFeedback)
class SessionFeedbackAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "session",
        "student",
        "created_by",
        "rating_clarity",
        "rating_engagement",
        "rating_pace",
        "created_at",
    ]
    list_filter = ["session__class_obj", "created_at"]
    search_fields = [
        "student__username",
        "student__first_name",
        "student__last_name",
        "created_by__username",
        "note",
    ]
    readonly_fields = ["created_at", "updated_at"]
