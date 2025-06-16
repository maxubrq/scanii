import { JsonSerializable } from '@scanii/domain';

/**
 * Hashes of the file.
 *
 * - sha256: 256-bit hash
 * - sha512: 512-bit hash
 * - md5: 128-bit hash
 */
export type FileHash = {
  sha256?: string;
  sha512?: string;
  md5?: string;
};

/**
 * Metadata of the file.
 *
 * - name: The name of the file.
 * - size: The size of the file.
 * - mimeType: The mime type of the file.
 */
export type FileMetadata = {
  name?: string;
  size?: number;
  mimeType?: string;
};

/**
 * Represents a file to be scanned.
 *
 * - id: The id of the file.
 * - hashes: The hashes of the file.
 * - metadata: The metadata of the file.
 * - downloadFromUrl: The url to download the file from.
 * - path: The path of the file in the file system.
 *
 * @example
 * ```ts
 * const file = new ScaniiFile('123');
 * file.withHashes({ sha256: '123', sha512: '123', md5: '123' });
 * file.withMetadata({ name: 'test.txt', size: 100, mimeType: 'text/plain' });
 * file.withDownloadFrom('https://example.com/test.txt');
 * file.withPath('/test.txt');
 * console.log(file.toJSON());
 * ```
 */
export class ScaniiFile implements JsonSerializable {
  private hashes?: FileHash;
  private metadata?: FileMetadata;
  private downloadFromUrl?: string;
  private path?: string;
  constructor(private readonly id: string) {
    if (!id) {
      throw new Error('ScaniiFile: Id is required');
    }
  }

  public withHashes(hashes: FileHash) {
    if (!hashes) {
      throw new Error('ScaniiFile: Hashes are required');
    }

    this.hashes = hashes;
    return this;
  }

  public withMetadata(metadata: FileMetadata) {
    if (!metadata) {
      throw new Error('ScaniiFile: Metadata is required');
    }

    this.metadata = metadata;
    return this;
  }

  public withDownloadFrom(downloadFrom: string) {
    if (!downloadFrom) {
      throw new Error('ScaniiFile: Download from is required');
    }

    this.downloadFromUrl = downloadFrom;
    return this;
  }

  public withPath(path: string) {
    if (!path) {
      throw new Error('ScaniiFile: Path is required');
    }

    this.path = path;
    return this;
  }

  public toJSON() {
    return {
      id: this.id,
      hashes: this.hashes,
      metadata: this.metadata,
      downloadFromUrl: this.downloadFromUrl,
      path: this.path,
    };
  }

  public static fromJSON(json: any) {
    return new ScaniiFile(json.id)
      .withHashes(json.hashes)
      .withMetadata(json.metadata)
      .withDownloadFrom(json.downloadFromUrl);
  }
}
