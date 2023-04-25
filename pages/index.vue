<template>
    <div>
        <MeetingFrame :call-id="callId" :offer-id="offerId" />
    </div>
</template>

<script setup>
import '~~/style.css'

definePageMeta({
    name: 'Meeting                                                                                          '
})

const route = useRoute();
const callId = route.query.call_id;
const offerId = route.query.offer_id;

</script>