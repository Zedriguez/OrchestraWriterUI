import type { Metadata } from "next";
import { SignInForm } from "@/components/auth/AuthForm";
import { safeNext } from "@/components/auth/next";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { next } = await searchParams;
  return <SignInForm next={safeNext(next)} />;
}
