import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, Shield } from "lucide-react"

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-4xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            駐車場管理システム
          </h1>
          <p className="text-lg text-gray-600">
            月極駐車場の契約・支払い管理
          </p>
        </div>

        {/* Access Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Contractor Card */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle className="text-2xl">利用者ポータル</CardTitle>
              </div>
              <CardDescription className="text-base">
                駐車場の利用状況確認と月額料金のお支払い
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/login?tab=contractor">
                <Button className="w-full" size="lg">
                  ポータルにアクセス
                </Button>
              </Link>
              <p className="text-sm text-gray-500 mt-3 text-center">
                登録されているお名前を入力してください
              </p>
            </CardContent>
          </Card>

          {/* Owner Card */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Shield className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle className="text-2xl">オーナー管理画面</CardTitle>
              </div>
              <CardDescription className="text-base">
                契約者管理と支払い履歴の確認
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/login?tab=owner">
                <Button className="w-full" size="lg" variant="outline">
                  オーナーログイン
                </Button>
              </Link>
              <p className="text-sm text-gray-500 mt-3 text-center">
                メールアドレスとパスワードでログイン
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>お困りの際は駐車場管理者にお問い合わせください</p>
        </div>
      </div>
    </div>
  )
}
