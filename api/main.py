import base64
import logging
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from litellm import completion
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI()


class ReceiptItem(BaseModel):
    name: str
    quantity: float
    price: float


class ReceiptAnalysisRequest(BaseModel):
    receipt_text: str
    model: str


class ReceiptAnalysisResponse(BaseModel):
    total: float
    store: str
    items: List[ReceiptItem]


@app.get("/health")
async def health_check():
    """
    Simple health check endpoint
    """
    return {"status": "healthy", "version": "1.0.0"}


def process_receipt_image(image_bytes: bytes, model: str) -> ReceiptAnalysisResponse:
    """
    Process receipt image directly using Pixtral model.
    """

    # Convert image bytes to base64
    base64_image = base64.b64encode(image_bytes).decode("utf-8")

    prompt = """Analyze this receipt image and extract:
    - Total amount
    - Store name
    - List of items with their quantities and prices

    Format your response as a JSON object with these exact keys:
    {
        "total": float,
        "store": string,
        "items": [
            {"name": string, "quantity": float, "price": float},
            ...
        ]
    }
    """

    try:
        response = completion(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}",
                                "detail": "high",
                            },
                        },
                    ],
                }
            ],
            temperature=0.1,
            max_tokens=1000,
        )

        # Extract the response content
        content = response.choices[0].message.content

        # Parse the response into our Pydantic model
        import json

        try:
            # Strip markdown code blocks if present
            content = content.replace("```json\n", "").replace("\n```", "")
            result = json.loads(content)
            return ReceiptAnalysisResponse(**result)
        except json.JSONDecodeError as je:
            logger.error(f"JSON parsing error: {je}")
            raise HTTPException(
                status_code=500, detail=f"Failed to parse LLM response as JSON: {je}"
            )
        except Exception as ve:
            logger.error(f"Validation error: {ve}")
            raise HTTPException(
                status_code=500, detail=f"Invalid response format: {ve}"
            )

    except Exception as e:
        logger.error(f"Processing Error: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        import traceback

        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze/image", response_model=ReceiptAnalysisResponse)
async def analyze_receipt_image(
    file: UploadFile = File(...),
    model: str = Form(model="mistral/pixtral-large-latest"),
):
    """
    Analyze a receipt from an uploaded image using Pixtral.
    Both file and model are sent as form-data.
    """
    try:
        logger.info(f"Processing image file: {file.filename} with model: {model}")
        contents = await file.read()
        logger.info(f"Read {len(contents)} bytes")
        return process_receipt_image(contents, model)
    except Exception as e:
        logger.error(f"Analysis Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/models")
async def list_models():
    """
    List available models for receipt analysis.
    """
    return {"models": ["mistral/pixtral-large-latest", "xai/grok-vision-beta"]}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=4001)
