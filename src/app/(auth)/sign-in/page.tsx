import type { Metadata } from "next";
import { SignInForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return <SignInForm />;
}
