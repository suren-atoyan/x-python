# pyright: reportMissingImports=false
# type: ignore

# black
import sys
import micropip
import asyncio
sys.modules["_multiprocessing"] = object

await micropip.install("jedi")
await micropip.install("black")

import jedi
from black import format_str, FileMode


def get_autocompletion(code, line, column):
    result = jedi.Interpreter(code, [globals(), locals()])

    completions = result.complete(line, column)

    matches = []
    for comp in completions:
        matches.append(dict(
            name=comp.name,
            type=comp.type,
            description=comp.description,
            full_name=comp.full_name
        ))

    return {
        "matches": matches
    }


async def install_pacakge(package):
    try:
        await micropip.install(package, keep_going=True)
        return {
            "success": True
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def format_code(code):
    return format_str(code, mode=FileMode())
