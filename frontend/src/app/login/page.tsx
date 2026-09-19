"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username, password);
      router.push("/dashboard");
    } catch {
      setError("Invalid credentials. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold text-cda-navy">myCDA</h1>
        <p className="mb-8 text-sm text-gray-500">
          Sign in to your account
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-cda-blue focus:outline-none focus:ring-1 focus:ring-cda-blue"
              required
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-cda-blue focus:outline-none focus:ring-1 focus:ring-cda-blue"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-cda-navy px-4 py-2 text-sm font-medium text-white hover:bg-cda-navy/90 disabled:opacity-50"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-8 rounded-md bg-gray-100 p-4 text-xs text-gray-500">
          <p className="mb-1 font-medium">Test accounts:</p>
          <p>student.emma / testpass123</p>
          <p>parent.james / testpass123</p>
          <p>coach.sarah / testpass123</p>
          <p>admin / testpass123</p>
        </div>

        {/* Candidate / Assignment Author Footer */}
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50/90 p-3 text-xs text-gray-600">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Candidate Profile
            </span>
            <span className="inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
              Author
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold text-gray-900">
            Devang S. P. Singh
          </p>
          <div className="mt-2 flex items-center gap-4 text-xs">
            <a
              href="mailto:devangshauryapratapsingh@gmail.com"
              className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-colors"
              title="devangshauryapratapsingh@gmail.com"
            >
              <svg
                className="h-3.5 w-3.5 text-red-500 shrink-0"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
              </svg>
              <span className="text-[11px]">Gmail</span>
            </a>

            <a
              href="https://www.linkedin.com/in/devangspsingh"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-gray-600 hover:text-blue-700 transition-colors"
              title="LinkedIn Profile"
            >
              <svg
                className="h-3.5 w-3.5 text-blue-600 shrink-0"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
              </svg>
              <span className="text-[11px]">LinkedIn</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

