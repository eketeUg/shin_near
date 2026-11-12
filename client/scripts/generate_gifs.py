import os
from PIL import Image

def spritesheets_to_gif(spritesheet_paths, output_gif_path, duration=100):
    try:
        frames = []
        for path in spritesheet_paths:
            if not os.path.exists(path):
                print(f"Skipping {path}, file not found.")
                continue

            with Image.open(path) as im:
                width, height = im.size
                
                # Dynamically infer frame dimensions since some sprites are 96x96 and others are 128x128
                frame_width = height
                frame_height = height
                
                if width % frame_width != 0:
                    print(f"Warning: {path} width {width} isn't divisible by {frame_width}.")
                
                num_frames = width // frame_width

                for i in range(num_frames):
                    box = (i * frame_width, 0, (i + 1) * frame_width, frame_height)
                    frame = im.crop(box)
                    # We need to copy because the file will be closed after the with block
                    frames.append(frame.copy())
                    
        if len(frames) == 0:
            print(f"No frames found for {output_gif_path}")
            return

        print(f"Saving {len(frames)} frames to {output_gif_path}...")
        # Save the frames as an animated GIF
        frames[0].save(
            output_gif_path,
            save_all=True,
            append_images=frames[1:],
            optimize=False,
            duration=duration,
            loop=0,
            disposal=2, # 2 = Restore to background color (handles transparency better)
            transparency=0
        )
        print(f"Successfully created {output_gif_path}")

    except Exception as e:
        print(f"Error processing {spritesheet_paths}: {e}")

if __name__ == "__main__":
    characters_dir = "public/assets/sprites"
    
    if not os.path.exists(characters_dir):
        print(f"Directory {characters_dir} not found.")
        exit(1)

    # Find all character directories
    for character_name in os.listdir(characters_dir):
        char_path = os.path.join(characters_dir, character_name)
        if os.path.isdir(char_path):
            idle_sprite = os.path.join(char_path, "Idle.png")
            attack_1_sprite = os.path.join(char_path, "Attack_1.png")
            
            out_gif_idle = os.path.join(char_path, "Idle.gif")
            out_gif_attack = os.path.join(char_path, "IdleAttack.gif")
            out_gif_all = os.path.join(char_path, "AllActions.gif")
            
            # Dynamically reads the height of the spritesheet to determine if it is 128x128 or 96x96 frames
            spritesheets_to_gif([idle_sprite], out_gif_idle, 100) # 100ms per frame = 10fps
            
            if os.path.exists(attack_1_sprite):
                spritesheets_to_gif([idle_sprite, attack_1_sprite], out_gif_attack, 100) # 100ms per frame = 10fps
            else:
                spritesheets_to_gif([idle_sprite], out_gif_attack, 100) # Fallback to just idle
                
            # Combine all possible actions
            possible_actions = ["Idle.png", "Walk.png", "Run.png", "Jump.png", "Attack_1.png", "Attack_2.png", "Attack_3.png", "Shield.png"]
            action_paths = []
            for action in possible_actions:
                action_path = os.path.join(char_path, action)
                if os.path.exists(action_path):
                    action_paths.append(action_path)
            
            if len(action_paths) > 0:
                spritesheets_to_gif(action_paths, out_gif_all, 100)
