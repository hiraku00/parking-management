import { redirect } from "next/navigation"
import { getSession } from "@/app/lib/auth"
import { Button } from "@/components/ui/button"
import { logout } from "@/app/login/actions"

export default async function PortalLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await getSession()
    const contractorId = session?.id

    if (!contractorId) {
        return redirect("/login?message=セッションが切れました。再度ログインしてください。")
    }

    // Use Admin Client for custom auth
    const { createAdminClient } = await import("@/utils/supabase/admin")
    const supabase = createAdminClient()
    const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, contract_start_month, contract_end_month")
        .eq("id", contractorId)
        .single()

    if (!profile) {
        return redirect("/login")
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                駐車場管理システム
                            </h1>
                            <p className="text-sm text-gray-600 mt-1">
                                ようこそ、{profile.full_name}さん
                                {profile.contract_start_month && (
                                    <span className="ml-2">
                                        (契約期間: {profile.contract_start_month} 〜 {profile.contract_end_month || '無期限'})
                                    </span>
                                )}
                            </p>
                        </div>
                        <form action={logout}>
                            <Button variant="outline" size="sm">
                                ログアウト
                            </Button>
                        </form>
                    </div>
                </div>
            </header>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    )
}
