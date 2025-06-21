import { JsonSerializable, skaniiFile } from '@skanii/domain';

/**
 * Represents a request to scan files.
 *
 * - id: The id of the request.
 * - files: The files to scan.
 *
 * @example
 * ```ts
 * const request = new skaniiRequest('123');
 * request.withFiles([new skaniiFile('123')]);
 * console.log(request.toJSON());
 * ```
 */
export class skaniiRequest implements JsonSerializable {
    private files: skaniiFile[] = [];
    constructor(private readonly id: string) {
        if (!id) {
            throw new Error('skaniiRequest: Id is required');
        }
    }

    public withFiles(files: skaniiFile[]) {
        if (!files) {
            throw new Error('skaniiRequest: Files are required');
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
