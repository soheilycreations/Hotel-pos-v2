import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Reset password — Hotel Rawana" };

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
