declare module "sshpk" {
  export function parseKey(
    data: string | Buffer,
    format?: string,
    name?: string
  ): any;
}
