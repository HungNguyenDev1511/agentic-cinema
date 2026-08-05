from google import genai
from google.genai.types import HttpOptions

client = genai.Client(
    vertexai=True,
    project="agentic-cinema-dev",
    location="global",
    http_options=HttpOptions(api_version="v1"),
)

response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=(
        "Reply with exactly this sentence and nothing else: "
        "Agentic Cinema is connected to Gemini through Google Cloud."
    ),
)

print(response.text)