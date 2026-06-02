'use client'

import * as React from 'react'
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form'

import { Input } from '../primitives/input'

interface FormFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>
  name: TName
  label?: string
  placeholder?: string
  type?: React.HTMLInputTypeAttribute
  disabled?: boolean
}

function FormField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  label,
  placeholder,
  type = 'text',
  disabled,
}: FormFieldProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Input
          {...field}
          label={label}
          type={type}
          placeholder={placeholder}
          disabled={disabled}
          error={fieldState.error?.message}
          value={field.value ?? ''}
        />
      )}
    />
  )
}

export { FormField }
