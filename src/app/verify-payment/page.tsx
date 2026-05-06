"use client";

import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Info, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

function VerifyPaymentContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const message = searchParams.get("message");
  const action = searchParams.get("action");
  const student = searchParams.get("student");
  const course = searchParams.get("course");

  const isSuccess = status === "success";
  const isError = status === "error";
  const isInfo = status === "info";

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100">
        <div className="p-8 text-center">
          {isSuccess && (
            <div className="mb-6 flex justify-center">
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
            </div>
          )}

          {isError && (
            <div className="mb-6 flex justify-center">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center">
                <XCircle className="w-10 h-10 text-red-500" />
              </div>
            </div>
          )}

          {isInfo && (
            <div className="mb-6 flex justify-center">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center">
                <Info className="w-10 h-10 text-blue-500" />
              </div>
            </div>
          )}

          {!status && (
            <div className="mb-6 flex justify-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-slate-400 animate-spin" />
              </div>
            </div>
          )}

          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            {isSuccess ? "Action Successful" : isError ? "Action Failed" : "Verification Status"}
          </h1>

          <div className="text-slate-600 mb-8">
            {isSuccess ? (
              <div className="space-y-2">
                <p>
                  You have successfully <strong>{action === 'approve' ? 'approved' : 'rejected'}</strong> the enrollment for:
                </p>
                <div className="bg-slate-50 p-4 rounded-xl text-sm text-left mt-4 border border-slate-100">
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400">Student:</span>
                    <span className="font-semibold text-slate-700">{student}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Course:</span>
                    <span className="font-semibold text-slate-700">{course}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p>{message || "Processing your request..."}</p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href="/"
              className="w-full bg-slate-900 text-white py-4 rounded-2xl font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Go to Homepage
            </Link>
            
            <p className="text-xs text-slate-400 mt-4">
              Creative By Dr. Shakil &bull; Secure Verification System
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 text-center border border-slate-100">
          <Loader2 className="w-10 h-10 text-slate-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading verification details...</p>
        </div>
      </div>
    }>
      <VerifyPaymentContent />
    </Suspense>
  );
}
