import { JsonSerializable, ScaniiFile } from '@scanii/domain';

/**
 * Represents a request to scan files.
 *
 * - id: The id of the request.
 * - files: The files to scan.
 *
 * @example
 * ```ts
 * const request = new ScaniiRequest('123');
 * request.withFiles([new ScaniiFile('123')]);
 * console.log(request.toJSON());
 * ```
 */
export class ScaniiRequest implements JsonSerializable {
  private files: ScaniiFile[] = [];
  constructor(private readonly id: string) {
    if (!id) {
      throw new Error('ScaniiRequest: Id is required');
    }
  }

  public withFiles(files: ScaniiFile[]) {
    if (!files) {
      throw new Error('ScaniiRequest: Files are required');
    }

    this.files = files;
    return this;
  }

  public toJSON() {
    return {
      id: this.id,
      files: this.files.map((file) => file.toJSON()),
    };
  }
}
