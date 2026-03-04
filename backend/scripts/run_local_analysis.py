import sys
import os
import json

here_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(here_dir, ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

def main():
    fast = "--fast" in sys.argv[1:]
    use_groq = "--groq" in sys.argv[1:]
    positional = [a for a in sys.argv[1:] if not a.startswith("-")]
    if positional:
        file_path = positional[0]
    else:
        here = os.path.dirname(os.path.abspath(__file__))
        candidate = os.path.abspath(os.path.join(here, "..", "..", "EUPHORIC MAIN.wav"))
        if os.path.isfile(candidate):
            file_path = candidate
        else:
            print("Usage: python scripts/run_local_analysis.py <audio_file_path> [--fast] [--groq]")
            sys.exit(1)
    if not os.path.isfile(file_path):
        print(json.dumps({"error": f"File not found: {file_path}"}))
        sys.exit(2)
    if use_groq:
        try:
            import asyncio
            from app.services.groq_whisper import GroqWhisperService
            async def run():
                data = await GroqWhisperService.full_pipeline(file_path, transcribe=True)
                print(json.dumps(data, ensure_ascii=False))
            asyncio.run(run())
        except Exception as e:
            print(json.dumps({"error": f"Groq pipeline failed: {str(e)}"}))
            sys.exit(4)
    else:
        try:
            from app.services.audio_analyzer import AdvancedAudioAnalyzer
        except Exception as e:
            print(json.dumps({"error": f"Import error: {str(e)}"}))
            sys.exit(3)
        try:
            result = AdvancedAudioAnalyzer.full_analysis(file_path, fast=fast)
            print(json.dumps(result, ensure_ascii=False))
        except Exception as e:
            print(json.dumps({"error": f"Analysis failed: {str(e)}"}))
            sys.exit(4)

if __name__ == "__main__":
    main()
