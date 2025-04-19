import { SupabaseDebug } from "@/components/supabase-debug"

export default function DebugPage() {
  return (
    <main className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Supabase Debug</h1>
      <p className="text-muted-foreground mb-6">Use this page to diagnose issues with your Supabase integration</p>
      <SupabaseDebug />
    </main>
  )
}
