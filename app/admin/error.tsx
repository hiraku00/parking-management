'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error(error)
    }, [error])

    return (
        <div className="flex min-h-[50vh] items-center justify-center">
            <Card className="w-full max-w-md border-red-200 bg-red-50">
                <CardHeader>
                    <CardTitle className="text-red-700">エラーが発生しました</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-red-600">
                        予期せぬエラーが発生しました。しばらく経ってから再度お試しください。
                        <br />
                        <span className="text-xs text-red-500 mt-2 block">
                            Error: {error.message}
                        </span>
                    </p>
                </CardContent>
                <CardFooter>
                    <Button
                        onClick={() => reset()}
                        variant="outline"
                        className="bg-white hover:bg-red-100 border-red-200 text-red-700"
                    >
                        再試行する
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
