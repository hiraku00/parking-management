import { createClient } from "@/utils/supabase/server"
import { OwnerSettingsForm } from "./owner-settings-form"
import { redirect } from "next/navigation"

export default async function SettingsPage() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("auth_id", user.id)
        .eq("role", "owner")
        .single()

    if (!profile) {
        return <div>Owner profile not found</div>
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">設定</h2>
                <p className="text-muted-foreground">
                    事業者情報や振込先口座の管理を行えます。
                </p>
            </div>
            <OwnerSettingsForm initialData={profile} />
        </div>
    )
}
