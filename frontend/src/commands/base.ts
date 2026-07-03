// Command pattern + history — undo/redo for all scene mutations (SPEC §4).
import { bus } from '../bus'

export interface Command {
  execute(): void
  undo(): void
  description: string // shown in UI, e.g. "Apply Force Layout"
}

class CommandHistory {
  private undoStack: Command[] = []
  private redoStack: Command[] = []

  execute(command: Command): void {
    command.execute()
    this.undoStack.push(command)
    this.redoStack = []
    this.notify()
  }

  undo(): void {
    const cmd = this.undoStack.pop()
    if (cmd) {
      cmd.undo()
      this.redoStack.push(cmd)
      this.notify()
    }
  }

  redo(): void {
    const cmd = this.redoStack.pop()
    if (cmd) {
      cmd.execute()
      this.undoStack.push(cmd)
      this.notify()
    }
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  private notify(): void {
    bus.emit('history:changed', {
      canUndo: this.canUndo,
      canRedo: this.canRedo,
    })
  }
}

export const history = new CommandHistory()
