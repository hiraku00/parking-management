'use client'

export function ReceiptStyle() {
    return (
        <style jsx global>{`
            @media print {
                @page { margin: 0; }
                body { background: white; }
            }
        `}</style>
    )
}
