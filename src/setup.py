# pyright: reportMissingImports=false
# type: ignore

import sys
import micropip
import asyncio
sys.modules["_multiprocessing"] = object

# micropip tries to install the latest version of a package
# we pin the version to avoid breaking changes
# here are the tested versions
await micropip.install("jedi==0.19.1")
await micropip.install("black==23.11.0")

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


def format_code(code, options):
    if options:
        mode = FileMode(**options)
        return format_str(code, mode=mode)
    return format_str(code, mode=FileMode())
