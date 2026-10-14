"""LLM provider abstraction layer."""
from abc import ABC, abstractmethod
from typing import List, Dict, Optional
import os


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @abstractmethod
    def generate(self, messages: List[Dict], temperature: float = 0.7, max_tokens: int = 4000) -> str:
        """Generate completion from messages."""
        pass

    @abstractmethod
    def validate_api_key(self) -> bool:
        """Validate API key."""
        pass

    @abstractmethod
    def count_tokens(self, text: str) -> int:
        """Estimate token count."""
        pass


class OpenAIProvider(LLMProvider):
    """OpenAI GPT provider."""

    def __init__(self, api_key: str, model: str = 'gpt-4o'):
        self.api_key = api_key
        self.model = model
        try:
            import openai
            self.client = openai.OpenAI(api_key=api_key)
        except ImportError:
            raise ImportError("openai package is required. Install with: pip install openai")

    def generate(self, messages: List[Dict], temperature: float = 0.3, max_tokens: int = 4000) -> str:
        """Generate completion using OpenAI."""
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )
            return response.choices[0].message.content
        except Exception as e:
            raise Exception(f"OpenAI generation failed: {str(e)}")

    def validate_api_key(self) -> bool:
        """Validate OpenAI API key."""
        try:
            self.client.models.list()
            return True
        except:
            return False

    def count_tokens(self, text: str) -> int:
        """Estimate token count (rough approximation)."""
        try:
            import tiktoken
            encoding = tiktoken.encoding_for_model(self.model)
            return len(encoding.encode(text))
        except:
            # Fallback: ~4 chars per token
            return len(text) // 4


class AnthropicProvider(LLMProvider):
    """Anthropic Claude provider."""

    def __init__(self, api_key: str, model: str = 'claude-3-5-sonnet-20241022'):
        self.api_key = api_key
        self.model = model
        try:
            import anthropic
            self.client = anthropic.Anthropic(api_key=api_key)
        except ImportError:
            raise ImportError("anthropic package is required. Install with: pip install anthropic")

    def generate(self, messages: List[Dict], temperature: float = 0.3, max_tokens: int = 4000) -> str:
        """Generate completion using Claude."""
        try:
            # Extract system message
            system_message = next((m['content'] for m in messages if m['role'] == 'system'), None)
            conversation = [m for m in messages if m['role'] != 'system']

            response = self.client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system_message,
                messages=conversation
            )
            return response.content[0].text
        except Exception as e:
            raise Exception(f"Anthropic generation failed: {str(e)}")

    def validate_api_key(self) -> bool:
        """Validate Anthropic API key."""
        try:
            self.client.messages.create(
                model=self.model,
                max_tokens=10,
                messages=[{"role": "user", "content": "test"}]
            )
            return True
        except:
            return False

    def count_tokens(self, text: str) -> int:
        """Estimate token count."""
        # Claude: ~3.5 chars per token
        return len(text) // 4


class GeminiProvider(LLMProvider):
    """Google Gemini provider."""

    def __init__(self, api_key: str, model: str = 'gemini-2.5-flash'):
        self.api_key = api_key
        self.model = model
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            self.client = genai.GenerativeModel(model)
        except ImportError:
            raise ImportError("google-generativeai package is required. Install with: pip install google-generativeai")

    def generate(self, messages: List[Dict], temperature: float = 0.3, max_tokens: int = 4000) -> str:
        """Generate completion using Gemini."""
        try:
            # Convert messages to Gemini format
            conversation = "\n\n".join([
                f"{m['role'].upper()}: {m['content']}" for m in messages
            ])

            response = self.client.generate_content(
                conversation,
                generation_config={
                    'temperature': temperature,
                    'max_output_tokens': max_tokens,
                }
            )
            return response.text
        except Exception as e:
            raise Exception(f"Gemini generation failed: {str(e)}")

    def generate_json(self, messages: List[Dict], response_schema: Dict,
                      temperature: float = 0.2, max_tokens: int = 8000) -> str:
        """Generate JSON completion constrained to a response schema.

        Returns the raw JSON text — caller is responsible for json.loads(). The
        schema constraint is enforced by Gemini's structured-output mode; we
        still validate slugs server-side as defense-in-depth (see body_locations).
        """
        try:
            conversation = "\n\n".join([
                f"{m['role'].upper()}: {m['content']}" for m in messages
            ])
            response = self.client.generate_content(
                conversation,
                generation_config={
                    'temperature': temperature,
                    'max_output_tokens': max_tokens,
                    'response_mime_type': 'application/json',
                    'response_schema': response_schema,
                },
            )
            return response.text
        except Exception as e:
            raise Exception(f"Gemini JSON generation failed: {str(e)}")

    def validate_api_key(self) -> bool:
        """Validate Gemini API key."""
        try:
            self.client.generate_content("test")
            return True
        except:
            return False

    def count_tokens(self, text: str) -> int:
        """Estimate token count."""
        return len(text) // 4


def get_llm_provider(provider_name: str, api_key: str, model: Optional[str] = None) -> LLMProvider:
    """Factory function to get LLM provider."""
    providers = {
        'openai': (OpenAIProvider, 'gpt-4o'),
        'anthropic': (AnthropicProvider, 'claude-3-5-sonnet-20241022'),
        'gemini': (GeminiProvider, 'gemini-2.5-flash'),
    }

    if provider_name not in providers:
        raise ValueError(f"Unknown provider: {provider_name}. Supported: {list(providers.keys())}")

    provider_class, default_model = providers[provider_name]
    return provider_class(api_key, model or default_model)
