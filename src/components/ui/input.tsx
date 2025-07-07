import * as React from 'react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={`flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white 
        placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 
        disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  )
})

Input.displayName = 'Input'

export { Input }
