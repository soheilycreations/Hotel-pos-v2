import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in — Hotel Rawana" };

const ERROR_MESSAGES: Record<string, string> = {
  invalid_or_expired_link: "That link is invalid or has expired. Request a new one and try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const linkError = error ? (ERROR_MESSAGES[error] ?? "Something went wrong with that link.") : null;

  return <LoginForm linkError={linkError} />;
}
