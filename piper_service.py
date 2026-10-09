"""Local neural speech service; communicates through stdin/stdout only."""
import sys, pathlib, json, io, wave, base64, os
ROOT = pathlib.Path(__file__).resolve().parent
sys.stdin.reconfigure(encoding='utf-8')
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, str(ROOT / 'runtime'))
from piper import PiperVoice, SynthesisConfig
from piper.config import PiperConfig
import onnxruntime
import piper
os.chdir(pathlib.Path(piper.__file__).resolve().parent)
models = {}
last_language = None
names = {'ru': 'ru_RU-ruslan-medium', 'en': 'en_US-lessac-high'}
for line in sys.stdin:
    request = {}
    try:
        request = json.loads(line)
        lang = request['lang']
        if lang not in models:
            models.clear()  # Keep only one voice model in memory on the free server.
            model_path = ROOT / 'voices' / (names[lang] + '.onnx')
            options = onnxruntime.SessionOptions()
            options.intra_op_num_threads = 2
            options.inter_op_num_threads = 1
            with open(str(model_path) + '.json', encoding='utf-8') as config_file:
                config = PiperConfig.from_dict(json.load(config_file))
            models[lang] = PiperVoice(config=config, session=onnxruntime.InferenceSession(str(model_path), sess_options=options, providers=['CPUExecutionProvider']), espeak_data_dir=pathlib.Path('espeak-ng-data'))
        output = io.BytesIO()
        config = SynthesisConfig(length_scale=1.0 / request['rate'])
        with wave.open(output, 'wb') as wav_file:
            models[lang].synthesize_wav(request['text'], wav_file, syn_config=config)
        print(json.dumps({'id': request['id'], 'wav': base64.b64encode(output.getvalue()).decode('ascii')}), flush=True)
    except Exception as error:
        print(json.dumps({'id': request.get('id'), 'error': 'Не удалось создать нейросетевой голос: ' + str(error)}, ensure_ascii=True), flush=True)
