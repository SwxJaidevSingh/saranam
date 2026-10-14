import * as React from "react"
import { cn } from "@/lib/utils"

const RadioGroupContext = React.createContext({})

const RadioGroup = React.forwardRef(({
  className,
  value,
  onValueChange,
  children,
  ...props
}, ref) => {
  return (
    <RadioGroupContext.Provider value={{ value, onValueChange }}>
      <div
        ref={ref}
        className={cn("grid gap-2", className)}
        {...props}
      >
        {children}
      </div>
    </RadioGroupContext.Provider>
  )
})
RadioGroup.displayName = "RadioGroup"

const RadioGroupItem = React.forwardRef(({
  className,
  value,
  id,
  ...props
}, ref) => {
  const { value: groupValue, onValueChange } = React.useContext(RadioGroupContext)

  const handleChange = () => {
    if (onValueChange) {
      onValueChange(value)
    }
  }

  return (
    <input
      type="radio"
      ref={ref}
      id={id}
      value={value}
      checked={groupValue === value}
      onChange={handleChange}
      className={cn(
        "aspect-square h-4 w-4 rounded-full border border-primary text-primary shadow focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
})
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }