import yaml from "js-yaml";
import { parseKey } from 'sshpk';

export function validatePublicSSHKey(content: string): boolean {
      try {
        const trimmed = content.trim();
        if (!trimmed || trimmed.length < 100 || trimmed.length > 100000) {
            return false;
        }
        const key: any = parseKey(trimmed, 'auto'); //validate private Key 
        if (!key || !key.source) {
            return false;
        }
        return true;
    } catch {
        return false;
    }
}


export function validateKubeConfig(content:string):boolean{
    try{
        const data=yaml.load(content)
        if(data && typeof data === "object" && "apiVersion" in data && "kind" in data && data.kind === "Config"){
            return true
        }
        return false
    }catch(e:any){
        console.log("Error Validating the kube file",e)
        return false
    }
}
