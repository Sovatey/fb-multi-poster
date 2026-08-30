import json
import httpx
from typing import Dict, Any, Optional
from app.utils.logger import get_logger

logger = get_logger("ai_service")

class AIService:
    @staticmethod
    async def _call_openai_api(prompt: str, settings: Dict[str, Any], system_prompt: str = "You are a helpful assistant.") -> str:
        api_key = settings.get("openaiApiKey")
        base_url = settings.get("openaiBaseUrl", "https://api.openai.com/v1").rstrip('/')
        model = settings.get("openaiModel", "gpt-4o-mini")
        
        if not api_key:
            raise ValueError("OpenAI API Key is not configured in Settings.")
            
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7
        }
        
        url = f"{base_url}/chat/completions"
        logger.info(f"Calling AI API: {url} with model {model}")
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json=payload, headers=headers, timeout=30.0)
                if response.status_code != 200:
                    logger.error(f"AI API failed with status {response.status_code}: {response.text}")
                    raise Exception(f"AI API Error: {response.text}")
                
                result = response.json()
                content = result["choices"][0]["message"]["content"].strip()
                return content
            except Exception as e:
                logger.error(f"Error connecting to AI API: {e}")
                raise e

    async def generate_title(self, story_summary: str, settings: Dict[str, Any]) -> str:
        prompt = f"Generate an optimized, engaging video title based on this summary: '{story_summary}'. Keep it short and under 100 characters. Return ONLY the title text. Do not wrap in quotes or add labels."
        return await self._call_openai_api(prompt, settings)

    async def generate_caption(self, story_summary: str, settings: Dict[str, Any]) -> str:
        prompt = f"Generate an engaging post caption based on this summary: '{story_summary}'. Return ONLY the caption text without hashtags, titles, or formatting wrappers."
        return await self._call_openai_api(prompt, settings)

    async def generate_hashtags(self, story_summary: str, settings: Dict[str, Any]) -> str:
        prompt = f"Generate a set of 5 to 8 relevant, trending hashtags based on this story summary: '{story_summary}'. Return only the hashtags separated by spaces (e.g. #AI #Storytelling). No extra text."
        return await self._call_openai_api(prompt, settings)

    async def generate_page_variations(self, story_summary: str, settings: Dict[str, Any]) -> Dict[str, str]:
        prompt = (
            f"Tailor three distinct versions of a caption for this story summary: '{story_summary}'.\n"
            f"1. 'NT Video': General viral appeal, energetic and engaging.\n"
            f"2. 'Midnight Tales': Dark, eerie, scary, mysterious, horror-themed.\n"
            f"3. 'StoryVerse': Magical, fantastical, sci-fi, or adventurous.\n\n"
            f"Return the result as a valid JSON object only. Do NOT include markdown code blocks. Structure:\n"
            f"{{\n"
            f"  \"NT Video\": \"caption content\",\n"
            f"  \"Midnight Tales\": \"caption content\",\n"
            f"  \"StoryVerse\": \"caption content\"\n"
            f"}}"
        )
        system_prompt = "You are a social media copywriter. You always reply with valid JSON only."
        response_text = await self._call_openai_api(prompt, settings, system_prompt=system_prompt)
        
        # Clean response text in case markdown blocks are present
        if response_text.startswith("```json"):
            response_text = response_text.replace("```json", "", 1)
        if response_text.endswith("```"):
            response_text = response_text.rsplit("```", 1)[0]
        response_text = response_text.strip()
        
        try:
            return json.loads(response_text)
        except Exception as e:
            logger.error(f"Failed to parse page variations JSON: {response_text}. Error: {e}")
            # Fallback variations
            return {
                "NT Video": f"Check this out! {story_summary}",
                "Midnight Tales": f"A dark mystery... {story_summary}",
                "StoryVerse": f"Explore the universe of stories... {story_summary}"
            }
