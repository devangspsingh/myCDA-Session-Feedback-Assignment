# Session Feedback: Design Decisions & Roadmap

A quick, honest breakdown of how this was built, the bug we found, why we designed it this way, and what to build next.

---

## 1. The Middleware Bug (And How We Fixed It)

The starter project came with `RequestAuditMiddleware` and `BaseModelSerializer` to auto-populate `created_by` from the logged-in user.

**The Bug:**
Django middleware runs *before* DRF views. When the middleware ran, DRF hadn't parsed the `Authorization: Token ...` header yet, so `request.user` was still `AnonymousUser`. The middleware saved `AnonymousUser` into thread-locals. Later, when the serializer ran, it couldn't find the logged-in user and crashed or left `created_by` empty.

**The Fix:**
In `core/middleware.py`, we changed thread-locals to store the `request` object instead of the user directly. When `get_current_user()` is called during serializer save, it looks up `request.user` *lazily*. By that point, DRF has already authenticated the user.

**Why not hack the serializer?**
We could have passed `request.user` manually in the view. But fixing the middleware fixes the platform globally for all models without bypassing the team's base serializer pattern.

---

## 2. Core Decisions

- **Unique on `(session, student)`**: Not `(session, submitter)`. This lets a parent review a session for multiple kids (Child A and Child B), while stopping anyone from reviewing the same kid twice for the same session.
- **3 Separate Ratings (1–5)**: Clarity, Engagement, and Pace. Keeps feedback actionable and allows clean SQL averaging without parsing messy JSON blobs.
- **Zero-Leak Anonymization**: We built a dedicated `InstructorFeedbackSummarySerializer` that only outputs aggregated numbers. Student names, IDs, and raw text notes don't exist in the serializer schema, making leaks impossible at the API level.
- **Duration-Weighted Rolling Average**: Computed over the last 10 completed sessions. A 90-minute debate round counts 1.5x more than a 60-minute session, so scores match actual teaching time.

---

## 3. Frontend UX Decisions

- **Unrated by Default (`0` Stars)**: Form loads with no stars selected. Forces the user to make a deliberate choice instead of lazily submitting a pre-filled 5 stars.
- **8-Second Auto-Dismiss**: Submitting shows a clear success card. It auto-resets after 8 seconds (or immediately on click) to a fresh, empty form for the next session.
- **"Load More" Pagination**: Review history loads 5 items at a time with a clean "Load More" button and review count.

---

## 4. Future Roadmap

1. **AI Review Summary (Amazon-Style)**:
   Raw notes are hidden from instructors to protect student privacy. In the future, run an LLM (Gemini/Claude) over recent notes to extract common themes (e.g., *"Students loved the rebuttal drills, but wanted 5 more minutes for crossfire"*). Instructors get useful advice with zero risk of identifying students.

2. **Threshold Rule for Small Classes ($k \ge 3$)**:
   In classes with only 1 or 2 kids, a coach can easily guess who gave a low score. We shouldn't show score updates until at least 3–4 reviews across multiple sessions have been collected.

3. **24-Hour Edit Window**:
   Allow parents/students to edit a submission within 24 hours to fix accidental misclicks or typos before ratings lock in permanently.

4. **Nightly Cron Job via Services Layer**:
   Right now, rolling averages are computed live on request. At scale, move this into a `services.py` layer and run it via a nightly cron job (or Celery worker) to precalculate scores into a cache table. This keeps dashboard loads instant ($O(1)$) with zero DB strain.
