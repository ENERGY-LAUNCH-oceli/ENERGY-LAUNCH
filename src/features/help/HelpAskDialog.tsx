import { Modal } from '@/components/ui/dialog';
import { AskPanel } from './AskPanel';
import { useHelpDialog } from './help-api';

/** «Помощь по сайту» из контекстного меню: вопрос своими словами – ответ из базы знаний, вопрос попадает в FAQ. */
export function HelpAskDialog() {
  const open = useHelpDialog((s) => s.open);
  const question = useHelpDialog((s) => s.question);
  const hide = useHelpDialog((s) => s.hide);
  return (
    <Modal open={open} onOpenChange={(v) => !v && hide()} title="Помощь по сайту" description="Спросите своими словами – помощник подберёт ответ и покажет нужное место на сайте." className="max-w-xl">
      {open && <AskPanel key={question} initial={question} autoFocus onAction={hide} />}
    </Modal>
  );
}
