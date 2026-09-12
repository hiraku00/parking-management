'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { loginContractorAction, type LoginFormState } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="h-14 w-full text-lg font-bold">
      {pending ? 'ログイン中...' : 'ログインする'}
    </Button>
  )
}

export function LoginForm() {
  const [state, formAction] = useActionState<LoginFormState, FormData>(loginContractorAction, {})

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <div className="rounded-md bg-destructive/10 p-4 text-base leading-relaxed text-destructive">
          {state.error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="name" className="text-base">
          お名前
        </Label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          required
          className="h-14 text-lg"
          placeholder="例: 田中太郎"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phoneLast4" className="text-base">
          電話番号の下4桁
        </Label>
        <Input
          id="phoneLast4"
          name="phoneLast4"
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          required
          className="h-14 text-lg tracking-widest"
          placeholder="例: 1234"
        />
      </div>
      <SubmitButton />
    </form>
  )
}
