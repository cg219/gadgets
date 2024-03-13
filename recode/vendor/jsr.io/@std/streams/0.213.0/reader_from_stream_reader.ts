// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { Buffer } from "jsr:/@std/io@^0.213.0/buffer";
import { writeAll } from "jsr:/@std/io@^0.213.0/write_all";
import type { Reader } from "jsr:/@std/io@^0.213.0/types";

/**
 * Create a {@linkcode Reader} from a {@linkcode ReadableStreamDefaultReader}.
 *
 * @example
 * ```ts
 * import { copy } from "@std/io/copy";
 * import { readerFromStreamReader } from "@std/streams/reader_from_stream_reader";
 *
 * const res = await fetch("https://deno.land");
 * using file = await Deno.open("./deno.land.html", { create: true, write: true });
 *
 * const reader = readerFromStreamReader(res.body!.getReader());
 * await copy(reader, file);
 * ```
 *
 * @deprecated (will be removed after 1.0.0) Use {@linkcode ReadableStreamDefaultReader} directly.
 */
export function readerFromStreamReader(
  streamReader: ReadableStreamDefaultReader<Uint8Array>,
): Reader {
  const buffer = new Buffer();

  return {
    async read(p: Uint8Array): Promise<number | null> {
      if (buffer.empty()) {
        const res = await streamReader.read();
        if (res.done) {
          return null; // EOF
        }

        await writeAll(buffer, res.value);
      }

      return buffer.read(p);
    },
  };
}
