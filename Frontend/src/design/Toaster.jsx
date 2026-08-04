import { Toaster as Sonner, toast } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: 'flex w-full items-start gap-2.5 rounded-lg bg-white px-4 py-3 shadow-lg ring-1 ring-gray-200',
          title: 'text-sm font-semibold text-gray-800',
          description: 'mt-0.5 text-xs text-gray-500',
          success: '!ring-green-200 !bg-green-50',
          error: '!ring-red-200 !bg-red-50',
          warning: '!ring-yellow-200 !bg-lama-yellow-light',
        },
      }}
    />
  );
}

export { toast };
