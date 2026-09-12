import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { loginOwner, loginContractor } from "./actions"

export default async function LoginPage({
    searchParams,
}: {
    searchParams: Promise<{ message?: string; tab?: string }>
}) {
    const { message, tab } = await searchParams
    const defaultTab = tab === 'owner' ? 'owner' : 'contractor'

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
            <div className="w-full max-w-md space-y-4">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">駐車場管理システム</h1>
                    <p className="text-gray-500">月極駐車場の契約・支払い管理</p>
                </div>

                {message && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm text-center">
                        {message}
                    </div>
                )}

                <Tabs defaultValue={defaultTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="contractor">ご利用者様</TabsTrigger>
                        <TabsTrigger value="owner">管理者用</TabsTrigger>
                    </TabsList>

                    <TabsContent value="contractor">
                        <Card>
                            <CardHeader>
                                <CardTitle>ご利用者様ログイン</CardTitle>
                                <CardDescription>
                                    登録されているお名前を入力して、次へお進みください。
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form action={loginContractor} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">お名前（フルネーム）</Label>
                                        <Input id="name" name="name" placeholder="例: 田中太郎" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="phone">電話番号（下4桁）</Label>
                                        <Input
                                            id="phone"
                                            name="phone"
                                            type="text"
                                            pattern="[0-9]{4}"
                                            maxLength={4}
                                            placeholder="例: 1234"
                                            required
                                        />
                                    </div>
                                    <Button type="submit" className="w-full font-bold text-lg h-12">
                                        ログインする
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="owner">
                        <Card>
                            <CardHeader>
                                <CardTitle>管理者ログイン</CardTitle>
                                <CardDescription>
                                    駐車場管理者専用のログイン画面です。
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form action={loginOwner} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="email">メールアドレス</Label>
                                        <Input id="email" name="email" type="email" placeholder="owner@example.com" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="password">パスワード</Label>
                                        <Input id="password" name="password" type="password" required />
                                    </div>
                                    <Button type="submit" className="w-full font-bold text-lg h-12">
                                        管理者としてログイン
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}
