"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Radio, User, Phone, Lock, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { userApi, extractErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

export default function SignupPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hydrated && user) router.replace("/dashboard");
  }, [hydrated, router, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // user-service requires a role; new users begin in victim mode and can switch modes later.
      const { data } = await userApi.post("/auth/signup", { name, phone, password, role: "victim" });
      setUser({ userId: data.userId, name: data.name, role: data.isValunteer ? "volunteer" : "victim" });
      toast.success(`Welcome, ${data.name}!`);
      router.replace("/dashboard");
    } catch (err) {
      toast.error(extractErrorMessage(err, "Signup nahi ho paya. Try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-paper">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="pulse-rings text-danger-500"><div className="w-12 h-12 rounded-2xl bg-danger-500 flex items-center justify-center text-white shadow-glow"><Radio size={22} /></div></div>
          <h1 className="font-display text-2xl font-semibold tracking-tight mt-2">Join SOS Connect</h1>
          <p className="text-sm text-ink/50 text-center">Create your account and stay ready when help matters.</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-card p-6 space-y-4">
          <div><label className="text-xs font-medium text-ink/50 mb-1.5 block">Full name</label><div className="relative"><User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/30" /><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Amit Kumar" className="w-full pl-10 pr-4 py-3 rounded-2xl bg-ink/[0.03] border border-transparent focus:border-signal-500 focus:bg-white outline-none text-sm transition-colors" /></div></div>
          <div><label className="text-xs font-medium text-ink/50 mb-1.5 block">Phone number</label><div className="relative"><Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/30" /><input required type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9999999991" className="w-full pl-10 pr-4 py-3 rounded-2xl bg-ink/[0.03] border border-transparent focus:border-signal-500 focus:bg-white outline-none text-sm transition-colors" /></div></div>
          <div><label className="text-xs font-medium text-ink/50 mb-1.5 block">Password</label><div className="relative"><Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/30" /><input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="w-full pl-10 pr-4 py-3 rounded-2xl bg-ink/[0.03] border border-transparent focus:border-signal-500 focus:bg-white outline-none text-sm transition-colors" /></div></div>
          <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-ink text-white font-medium text-sm py-3.5 rounded-2xl hover:bg-ink/90 active:scale-[0.98] transition disabled:opacity-60">{loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}{loading ? "Creating account…" : "Create account"}</button>
        </form>
        <p className="text-center text-sm text-ink/50 mt-6">Already registered? <Link href="/login" className="text-signal-600 font-medium hover:underline">Log in</Link></p>
      </div>
    </main>
  );
}
