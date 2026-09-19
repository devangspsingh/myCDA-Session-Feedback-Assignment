from django.urls import path
from . import views

urlpatterns = [
    path("", views.SessionFeedbackCreateView.as_view(), name="feedback-create"),
    path("my/", views.MyFeedbackListView.as_view(), name="feedback-my"),
    path("my-feedback/", views.MyFeedbackListView.as_view(), name="feedback-my-alias"),
    path(
        "eligible-sessions/",
        views.EligibleSessionsListView.as_view(),
        name="feedback-eligible-sessions",
    ),
    path(
        "instructor-summary/",
        views.InstructorSummaryView.as_view(),
        name="feedback-instructor-summary",
    ),
]
