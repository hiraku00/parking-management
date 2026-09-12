import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function Loading() {
    return (
        <div className="space-y-6">
            {/* Alert area */}
            <Skeleton className="h-16 w-full rounded-md" />

            {/* Payment Area Skeleton */}
            <Card>
                <CardHeader>
                    <CardTitle><Skeleton className="h-6 w-40" /></CardTitle>
                    <div className="space-y-2 pt-2">
                        <Skeleton className="h-4 w-full max-w-md" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <Skeleton className="h-24 w-full rounded-lg" />
                            <Skeleton className="h-24 w-full rounded-lg" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* History Table Skeleton */}
            <div className="space-y-2">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        </div>
    )
}
