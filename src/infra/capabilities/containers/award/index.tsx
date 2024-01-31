import { useStore } from '@classroom/infra/hooks/ui-store';
import { observer } from 'mobx-react';
import { SvgaPlayer, SoundPlayer } from '@classroom/ui-kit';

import RewardSVGA from '../stream/assets/svga/reward.svga';
import RewardSound from '../stream/assets/audio/reward.mp3';
import { useRef } from 'react';
import { EduStreamUI } from '@classroom/infra/stores/common/stream/struct';

export const Award = observer(({ stream }: { stream: EduStreamUI }) => {
  const {
    streamUIStore: { streamAwardAnims, removeAward },
  } = useStore();
  const ref = useRef<HTMLDivElement>(null);

  return stream ? (
    <div ref={ref} className="center-reward">
      {streamAwardAnims(stream).map((anim: { id: string; userUuid: string }) => {
        const width = ref.current?.clientWidth || 0;
        const height = ref.current?.clientHeight || 0;
        return (
          <SvgaPlayer
            key={anim.id}
            width={width}
            height={height}
            style={{ position: 'absolute' }}
            url={RewardSVGA}
            onFinish={() => {
              removeAward(anim.id);
            }}
          ></SvgaPlayer>
        );
      })}

      {streamAwardAnims(stream).map((anim: { id: string; userUuid: string }) => {
        return <SoundPlayer url={RewardSound} key={anim.id} />;
      })}
    </div>
  ) : null;
});
export default Award;
