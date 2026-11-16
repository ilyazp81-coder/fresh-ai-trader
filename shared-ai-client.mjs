import {chainCommand} from './router.mjs';
export const sharedBudgetEnabled=env=>env.AI_SHARED_BUDGET==='yes';
export const RESEARCH_AI_MODEL='@cf/meta/llama-3.2-3b-instruct';
export async function researchAi(env,purpose,input,evidenceKey=''){
 if(!sharedBudgetEnabled(env))return env.AI.run(String(env.AI_MODEL||RESEARCH_AI_MODEL).trim(),input);
 if(!['directional','review'].includes(purpose))throw Error('AI_SHARED_NONTRADING_DISABLED');
 if(!env.OPTION_CHAIN)throw Error('AI_SHARED_COORDINATOR_UNAVAILABLE');
 const response=await chainCommand(env,'ai-run',{purpose,input,evidenceKey:String(evidenceKey).slice(0,1000)});
 if(!Object.hasOwn(response,'result'))throw Error('AI_SHARED_RESPONSE_UNAVAILABLE');return response.result;
}
export function sharedResearchEnvironment(env){
 if(!sharedBudgetEnabled(env))return env;
 // Every generic/raw AI call is disabled. Only explicit entry-review functions
 // can access the single durable shared governor through the private binding.
 return {...env,AI:{run:(_model,input)=>researchAi(env,'auxiliary',input)}};
}
