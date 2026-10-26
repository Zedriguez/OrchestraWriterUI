import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/AuthForm";
import { safeNext } from "@/components/auth/next";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const { next } = await searchParams;
  return <SignUpForm next={safeNext(next)} />;
}
