import { AuthSplit } from "@/components/auth/AuthSplit";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthSplit>{children}</AuthSplit>;
}
