import * as RadixTabs from "@radix-ui/react-tabs";
import React from "react";
import { cn } from "../../utils/cn";

export const TabsRoot = RadixTabs.Root;

interface TabsListProps extends React.ComponentPropsWithoutRef<typeof RadixTabs.List> {}

export const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(({ className, ...props }, ref) => (
  <RadixTabs.List
    ref={ref}
    className={cn(
      "inline-flex items-center gap-2 rounded-xl bg-slate-900/70 p-1 text-sm text-slate-300",
      className
    )}
    {...props}
  />
));

TabsList.displayName = "TabsList";

interface TabsTriggerProps extends React.ComponentPropsWithoutRef<typeof RadixTabs.Trigger> {}

export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, ...props }, ref) => (
    <RadixTabs.Trigger
      ref={ref}
      className={cn(
        "inline-flex min-w-[120px] items-center justify-center rounded-lg px-4 py-2 transition-colors data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=inactive]:text-slate-400",
        className
      )}
      {...props}
    />
  )
);

TabsTrigger.displayName = "TabsTrigger";

interface TabsContentProps extends React.ComponentPropsWithoutRef<typeof RadixTabs.Content> {}

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, ...props }, ref) => (
    <RadixTabs.Content
      ref={ref}
      className={cn("mt-4 animate-fade", className)}
      {...props}
    />
  )
);

TabsContent.displayName = "TabsContent";

export const Tabs = {
  Root: TabsRoot,
  List: TabsList,
  Trigger: TabsTrigger,
  Content: TabsContent
};
