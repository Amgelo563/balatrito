/** Reassembles newline-delimited messages from arbitrary socket chunks. */
export class LineBuffer {
  protected pending = '';

  public static create(): LineBuffer {
    return new LineBuffer();
  }

  /** Appends a chunk and returns every complete line it closed. */
  public push(chunk: string): string[] {
    this.pending += chunk;
    const lines = this.pending.split('\n');
    this.pending = lines.pop() ?? '';
    return lines.map((line) => line.trim()).filter((line) => line.length > 0);
  }

  /** Drops any partial line, as after a reconnection. */
  public reset(): this {
    this.pending = '';
    return this;
  }
}
