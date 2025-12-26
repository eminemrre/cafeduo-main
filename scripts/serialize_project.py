import os
import json
import sys
import traceback

def serialize_project(root_dir, output_file):
    print(f"Starting serialization from {root_dir}")
    project_data = {
        "project_name": os.path.basename(os.path.abspath(root_dir)),
        "files": []
    }

    # Dizinler ve dosyalar yoksayılacak
    ignore_dirs = {
        'node_modules', '.git', '.firebase', 'dist', '.vscode', 'logs', 
        'build', 'coverage', '__pycache__', '.gemini', 'tmp'
    }
    ignore_files = {
        'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 
        'project_dump.json', '.DS_Store', 'project_context.json'
    }
    
    # İkili (binary) dosya uzantıları yoksayılacak
    binary_extensions = {
        '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', 
        '.ttf', '.eot', '.mp4', '.webm', '.mp3', '.wav', '.pdf', '.zip', 
        '.tar', '.gz', '.pyc', '.exe', '.dll', '.so', '.dylib'
    }

    try:
        for root, dirs, files in os.walk(root_dir):
            if '.git' in dirs:
                dirs.remove('.git') # Optimization to not walk git
            
            # Yoksayılacak dizinleri çıkart
            dirs[:] = [d for d in dirs if d not in ignore_dirs]
            
            for file in files:
                if file in ignore_files:
                    continue
                    
                _, ext = os.path.splitext(file)
                if ext.lower() in binary_extensions:
                    continue

                file_path = os.path.join(root, file)
                # Skip the script itself if it's in the way (though it's in scripts/)
                if os.path.abspath(file_path) == os.path.abspath(__file__):
                    continue

                relative_path = os.path.relpath(file_path, root_dir)
                
                try:
                    # Windows often has encoding issues, try utf-8 then latin-1
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                    except UnicodeDecodeError:
                        with open(file_path, 'r', encoding='latin-1') as f:
                            content = f.read()
                    
                    project_data["files"].append({
                        "path": relative_path,
                        "content": content
                    })
                except Exception as e:
                    print(f"Skipping file {relative_path}: {str(e)}")

        print(f"Writing to {output_file}...")
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(project_data, f, indent=2, ensure_ascii=False)
        
        print(f"Project serialized to {output_file}")
        print(f"Total files: {len(project_data['files'])}")

    except Exception:
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    try:
        # Scriptin bulunduğu klasörden bir üst klasöre (proje köküne) bak
        current_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(current_dir)
        output_path = os.path.join(project_root, 'project_dump.json')
        
        serialize_project(project_root, output_path)
    except Exception:
        traceback.print_exc()
        sys.exit(1)
