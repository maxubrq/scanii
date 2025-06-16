import { FileHash } from '@scanii/domain';

/**
 * Hash algorithms supported by the API.
 *
 * - SHA256: 256-bit hash
 * - SHA512: 512-bit hash
 * - MD5: 128-bit hash
 */
export enum HashAlgorithm {
  SHA256 = 'sha256',
  SHA512 = 'sha512',
  MD5 = 'md5',
}

/**
 * Hash a file using the specified algorithm.
 *
 * @param file - The file to hash.
 * @param algorithm - The algorithm to use.
 * @returns The hash of the file.
 * @example
 * ```ts
 * const file = new File([], 'test.txt');
 * const hash = await hashFileOne(file, HashAlgorithm.SHA256);
 * console.log(hash);
 * ```
 */
export async function hashFileOne(file: File, algorithm: HashAlgorithm): Promise<string> {
  const hash = await crypto.subtle.digest(algorithm, await file.arrayBuffer());
  return hash.toString();
}

/**
 * Hash a file using all supported algorithms.
 *
 * @param file - The file to hash.
 * @returns The hashes of the file.
 *          - SHA256: 256-bit hash
 *          - SHA512: 512-bit hash
 *          - MD5: 128-bit hash
 * @example
 * ```ts
 * const file = new File([], 'test.txt');
 * const hashes = await hashFile(file);
 * console.log(hashes);
 * ```
 */
export async function hashFile(file: File): Promise<FileHash> {
  const algs = Object.values(HashAlgorithm);
  const hashes = await Promise.all(algs.map((alg) => hashFileOne(file, alg)));
  return {
    [HashAlgorithm.SHA256]: hashes[0],
    [HashAlgorithm.SHA512]: hashes[1],
    [HashAlgorithm.MD5]: hashes[2],
  };
}
